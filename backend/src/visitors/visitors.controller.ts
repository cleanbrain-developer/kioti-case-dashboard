import { Controller, Get, Post } from '@nestjs/common';
import { VisitorsService } from './visitors.service';

@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post('ping')
  ping() { return this.visitorsService.ping(); }

  @Get('today')
  getToday() { return this.visitorsService.getToday(); }
}
