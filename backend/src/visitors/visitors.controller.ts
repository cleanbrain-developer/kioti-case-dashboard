import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { VisitorsService } from './visitors.service';

@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post('ping')
  ping(@Body() body: { date?: string; sessionId?: string }) {
    return this.visitorsService.ping(body?.date, body?.sessionId);
  }

  @Get('today')
  getToday(@Query('date') date?: string) {
    return this.visitorsService.getToday(date);
  }
}
