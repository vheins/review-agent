import { Module } from '@nestjs/common';
import { CommentParserService } from './comment-parser.service.js';

@Module({
  providers: [CommentParserService],
  exports: [CommentParserService],
})
export class CommentParserModule {}
