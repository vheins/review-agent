import { Module, Global } from '@nestjs/common';
import { TuiService } from './tui.service.js';

@Global()
@Module({
  providers: [TuiService],
  exports: [TuiService],
})
export class TuiModule {}
