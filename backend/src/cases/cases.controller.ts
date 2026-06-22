import { Controller, Get, Query } from '@nestjs/common';
import { CasesService } from './cases.service';
import { QueryCasesDto } from './dto/query-cases.dto';

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(@Query() query: QueryCasesDto) {
    return this.casesService.findAll(query);
  }
}
