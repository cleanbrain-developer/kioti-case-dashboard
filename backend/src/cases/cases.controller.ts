import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { CasesService } from './cases.service';
import { SalesforceService } from '../salesforce/salesforce.service';
import { QueryCasesDto } from './dto/query-cases.dto';

@Controller('cases')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly sf: SalesforceService,
  ) {}

  @Get()
  async findAll(@Query() query: QueryCasesDto) {
    if (!this.sf.isConfigured()) throw new ServiceUnavailableException('Salesforce not configured');
    return this.casesService.findAll(query);
  }
}
