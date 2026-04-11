/**
 * PdfGeneratorService
 * ────────────────────
 * Core PDF engine using Handlebars (.hbs templates) + Puppeteer.
 *
 * Flow:
 *   1. Load .hbs file from disk
 *   2. Compile with Handlebars + inject data context
 *   3. Render the HTML string to PDF via headless Chromium
 *   4. Return the PDF as a Buffer
 *
 * Callers decide how to deliver the buffer:
 *   - HTTP download (stream to response)
 *   - Email attachment
 *   - Save to disk / cloud
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import puppeteer, { Browser } from 'puppeteer';
import { ReportTemplate } from '../interfaces/report-template.interface';
import { ShipmentManifestTemplate } from '../report-definitions/shipment-manifest.template';
import { ProformaInvoiceTemplate } from '../report-definitions/proforma-invoice.template';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@Injectable()
export class PdfGeneratorService implements OnModuleInit, OnModuleDestroy {
  /** Template registry — keyed by templateKey */
  private readonly templates = new Map<string, ReportTemplate>();

  /** Compiled Handlebars templates — cached for performance */
  private readonly compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

  /** Shared Puppeteer browser instance (reused across requests) */
  private browser: Browser | null = null;

  constructor(private readonly logger: CustomLoggerService) {}

  // ════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ════════════════════════════════════════════════════════════

  async onModuleInit(): Promise<void> {
    // Register all templates
    this.registerTemplate(new ShipmentManifestTemplate());
    this.registerTemplate(new ProformaInvoiceTemplate());
    this.logger.log(`PdfGeneratorService initialised with ${this.templates.size} template(s)`);

    // Pre-compile all .hbs templates
    this.precompileTemplates();

    // Launch shared browser instance
    await this.launchBrowser();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('Puppeteer browser instance closed');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  TEMPLATE MANAGEMENT
  // ════════════════════════════════════════════════════════════

  /** Register a template into the registry */
  registerTemplate(template: ReportTemplate): void {
    this.templates.set(template.templateKey, template);
    this.logger.log(`Registered PDF template: ${template.templateKey} → ${template.templateFile}`);
  }

  private precompileTemplates(): void {
    const possibleDirs = [
      join(process.cwd(), 'src', 'templates', 'reports'),
      join(process.cwd(), 'dist', 'src', 'templates', 'reports'),
      join(process.cwd(), 'dist', 'templates', 'reports'),
      join(process.cwd(), 'templates', 'reports'),
      join(__dirname, '..', '..', '..', 'templates', 'reports'),
    ];

    let templatesDir = '';
    for (const dir of possibleDirs) {
      if (existsSync(dir)) {
        templatesDir = dir;
        break;
      }
    }

    if (!templatesDir) {
      this.logger.error(`Failed to locate PDF templates directory. Checked: ${possibleDirs.join(', ')}`);
      return;
    }

    this.logger.log(`Using templates directory: ${templatesDir}`);

    for (const [key, template] of this.templates) {
      try {
        const filePath = join(templatesDir, template.templateFile);
        if (!existsSync(filePath)) {
          this.logger.error(`Template file NOT found: ${filePath} (key: ${key})`);
          continue;
        }
        const source = readFileSync(filePath, 'utf-8');
        this.compiledTemplates.set(key, Handlebars.compile(source));
        this.logger.log(`Successfully compiled HBS template: ${template.templateFile}`);
      } catch (err: any) {
        this.logger.error(`Exception while compiling template "${key}": ${err.message}`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  BROWSER MANAGEMENT
  // ════════════════════════════════════════════════════════════

  /** Launch a shared Puppeteer browser (reused across requests for performance) */
  private async launchBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',   // Prevents /dev/shm issues in Docker
          '--disable-gpu',
          '--font-render-hinting=none', // Consistent font rendering
        ],
      });
      this.logger.log(`Puppeteer browser launched (shared instance) from ${process.env.PUPPETEER_EXECUTABLE_PATH || 'default path'}`);
    } catch (err: any) {
      this.logger.error(`Failed to launch Puppeteer: ${err.message}`);
      throw err;
    }
  }

  /** Get or recreate the browser instance */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.logger.warn('Browser disconnected — relaunching...');
      await this.launchBrowser();
    }
    return this.browser!;
  }

  // ════════════════════════════════════════════════════════════
  //  PDF GENERATION
  // ════════════════════════════════════════════════════════════

  /**
   * Generate a PDF buffer for the given template key and raw data.
   *
   * @param templateKey - Registered template identifier (e.g. 'shipment-manifest')
   * @param rawData     - Raw data passed to the template's prepareContext()
   * @returns           - PDF file as a Buffer
   */
  async generate(templateKey: string, rawData: any): Promise<Buffer> {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new Error(`PDF template "${templateKey}" is not registered`);
    }

    const compiled = this.compiledTemplates.get(templateKey);
    if (!compiled) {
      throw new Error(`HBS template for "${templateKey}" is not compiled`);
    }

    this.logger.log(`Generating PDF: ${template.reportName} (template: ${templateKey})`);

    // 1. Prepare context data
    const context = template.prepareContext(rawData);

    // 2. Render HTML from Handlebars template
    const html = compiled(context);

    // 3. Convert HTML → PDF via Puppeteer
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfOptions = template.pdfOptions || {};
      const pdfBuffer = await page.pdf({
        format: (pdfOptions.format as any) || 'A4',
        landscape: pdfOptions.landscape || false,
        margin: pdfOptions.margin || { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
        printBackground: true,        // Preserve background colours
        preferCSSPageSize: false,
      });

      // page.pdf() returns a Uint8Array; convert it to a Node Buffer
      const buffer = Buffer.from(pdfBuffer);

      this.logger.log(`PDF generated: ${template.reportName} (${(buffer.length / 1024).toFixed(1)} KB)`);
      return buffer;
    } finally {
      await page.close();
    }
  }
}
