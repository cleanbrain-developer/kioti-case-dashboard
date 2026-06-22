import { Global, Module } from '@nestjs/common';
import { SalesforceService } from './salesforce.service';

@Global()
@Module({ providers: [SalesforceService], exports: [SalesforceService] })
export class SalesforceModule {}
