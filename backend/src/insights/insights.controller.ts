import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { SalesforceService } from '../salesforce/salesforce.service';

@Controller('insights')
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly sf: SalesforceService,
  ) {}

  @Get()
  async getInsights() {
    if (!this.sf.isConfigured()) throw new ServiceUnavailableException('Salesforce not configured');
    return this.insightsService.getInsights();
  }

  @Get('drill')
  async getDrill(@Query('department') department?: string) {
    if (!this.sf.isConfigured()) throw new ServiceUnavailableException('Salesforce not configured');
    return this.insightsService.getDrill(department);
  }
}
