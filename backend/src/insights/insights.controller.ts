import { Controller, Get, Query } from '@nestjs/common';
import { InsightsService } from './insights.service';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  getInsights() {
    return this.insightsService.getInsights();
  }

  @Get('drill')
  getDrill(@Query('department') department?: string) {
    return this.insightsService.getDrill(department);
  }

  @Get('aging')
  getAging() {
    return this.insightsService.getAging();
  }
}
