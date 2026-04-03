/**
 * ReportTemplate Interface
 * ────────────────────────
 * Contract that every PDF report template must implement.
 * Templates are now HTML-based (.hbs files) rendered by Handlebars.
 *
 * To add a new report type:
 *   1. Create a .hbs file in /templates/
 *   2. Create a class implementing this interface
 *   3. Register it in PdfGeneratorService
 */

export interface ReportTemplate {
  /** Unique key used to look up this template (e.g. 'shipment-manifest') */
  readonly templateKey: string;

  /** Human-readable name used for the PDF filename (e.g. 'Shipment_Manifest') */
  readonly reportName: string;

  /** Relative path to the .hbs template file (from the templates/ directory) */
  readonly templateFile: string;

  /**
   * Transform raw domain data into the shape expected by the .hbs template.
   * This is where you map DB entities into template-friendly variables.
   *
   * @param rawData - Raw data from the service layer (DB entities, etc.)
   * @returns       - Context object passed into Handlebars {{variables}}
   */
  prepareContext(rawData: any): Record<string, any>;

  /**
   * Optional PDF page configuration.
   * Defaults to A4, portrait, with standard margins.
   */
  pdfOptions?: {
    format?: 'A4' | 'A3' | 'Letter' | 'Legal';
    landscape?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  };
}
