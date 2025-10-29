import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { Catalog, CatalogDocument } from './schemas/catalog.schema';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Catalog.name)
    private catalogModel: Model<CatalogDocument>
  ) {}

  async create(orgId: string, dto: CreateCatalogDto) {
    const exists = await this.catalogModel.findOne({ organizationId: orgId });
    if (exists) throw new BadRequestException('Catalog already exists');
    return new this.catalogModel({ ...dto, organizationId: orgId }).save();
  }

  async getByOrganizationId(orgId: string) {
    const catalog = await this.catalogModel.findOne({ organizationId: orgId });
    if (!catalog) throw new NotFoundException('Catalog not found');
    return catalog;
  }

  async update(orgId: string, dto: UpdateCatalogDto) {
    const updated = await this.catalogModel.findOneAndUpdate(
      { organizationId: orgId }, dto, { new: true }
    );
    if (!updated) throw new NotFoundException('Catalog not found');
    return updated;
  }

  async addCategory(orgId: string, category: string) {
    return this.catalogModel.updateOne(
      { organizationId: orgId },
      { $addToSet: { categories: category } }
    );
  }

  async addGrade(orgId: string, grade: { code: string; name: string }) {
    return this.catalogModel.updateOne(
      { organizationId: orgId },
      { $addToSet: { grades: grade } }
    );
  }

  async search(filter: Record<string, string>) {
    // basic search on categories/grades
    return this.catalogModel.find(filter).limit(30);
  }
}
