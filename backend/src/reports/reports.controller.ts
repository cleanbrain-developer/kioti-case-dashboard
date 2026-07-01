import { Body, Controller, Delete, Get, Param, Post, Put, HttpCode } from '@nestjs/common';
import { ReportsService, type RecipientDto, type ScheduleDto } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  // Recipients
  @Get('recipients')
  listRecipients() { return this.svc.listRecipients(); }

  @Post('recipients')
  createRecipient(@Body() dto: RecipientDto) { return this.svc.createRecipient(dto); }

  @Put('recipients/:id')
  updateRecipient(@Param('id') id: string, @Body() dto: RecipientDto) {
    return this.svc.updateRecipient(parseInt(id, 10), dto);
  }

  @Delete('recipients/:id')
  @HttpCode(200)
  deleteRecipient(@Param('id') id: string) {
    return this.svc.deleteRecipient(parseInt(id, 10));
  }

  // Schedule
  @Get('schedule')
  getSchedule() { return this.svc.getSchedule(); }

  @Put('schedule')
  updateSchedule(@Body() dto: ScheduleDto) { return this.svc.updateSchedule(dto); }

  // Departments
  @Get('departments')
  getDepartments() { return this.svc.getDepartments(); }

  // Send
  @Post('send-test')
  sendTest(@Body() body: { email: string; department: string }) {
    return this.svc.sendTest(body.email, body.department);
  }

  @Post('send-now')
  sendNow() { return this.svc.sendNow(); }
}
