import { Injectable } from '@nestjs/common';
import fs from 'fs-extra';
import * as path from 'path';
import type { ParsedComment } from '../../../common/parser/comment-parser.service.js';

type ChangedFile = {
  path: string;
  content: string;
};

@Injectable()
export class DocumentationReviewService {
  async analyzeChangedFiles(changedFiles: ChangedFile[], repoDir: string): Promise<ParsedComment[]> {
    const markdownFiles = changedFiles.filter((file) => this.isMarkdownFile(file.path));
    const findings = await Promise.all(markdownFiles.map((file) => this.analyzeFile(file, repoDir)));
    return findings.flat();
  }

  private isMarkdownFile(filePath: string): boolean {
    return /\.md(?:own)?$/i.test(filePath);
  }

  private async analyzeFile(file: ChangedFile, repoDir: string): Promise<ParsedComment[]> {
    const findings: ParsedComment[] = [];
    const lines = file.content.split('\n');
    const headings = this.collectHeadings(lines);

    findings.push(...this.validateTopLevelHeading(file.path, headings));
    findings.push(...this.validateHeadingHierarchy(file.path, headings));
    findings.push(...this.validateEmptySections(file.path, headings, lines));
    findings.push(...this.validateCodeFences(file.path, lines));
    findings.push(...await this.validateRelativeLinks(file.path, file.content, repoDir));

    if (this.isReadme(file.path)) {
      findings.push(...this.validateReadmeSections(file.path, headings));
    }

    return findings;
  }

  private collectHeadings(lines: string[]): Array<{ line: number; level: number; title: string }> {
    const headings: Array<{ line: number; level: number; title: string }> = [];

    for (const [index, line] of lines.entries()) {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line.trim());
      if (!match) continue;

      headings.push({
        line: index + 1,
        level: match[1].length,
        title: match[2],
      });
    }

    return headings;
  }

  private validateTopLevelHeading(filePath: string, headings: Array<{ line: number; level: number; title: string }>): ParsedComment[] {
    const h1Headings = headings.filter((heading) => heading.level === 1);

    if (h1Headings.length === 0) {
      return [this.createFinding(filePath, 1, 'error', 'Dokumentasi ini belum punya heading `#` utama sebagai judul file.')];
    }

    if (h1Headings.length > 1) {
      return [this.createFinding(filePath, h1Headings[1].line, 'warning', 'Gunakan satu heading `#` utama saja agar struktur dokumen konsisten.')];
    }

    return [];
  }

  private validateHeadingHierarchy(filePath: string, headings: Array<{ line: number; level: number; title: string }>): ParsedComment[] {
    const findings: ParsedComment[] = [];

    for (let index = 1; index < headings.length; index++) {
      const previous = headings[index - 1];
      const current = headings[index];

      if (current.level > previous.level + 1) {
        findings.push(
          this.createFinding(
            filePath,
            current.line,
            'warning',
            `Level heading melompat dari H${previous.level} ke H${current.level}. Turunkan ke H${previous.level + 1} atau rapikan hirarkinya.`,
          ),
        );
      }
    }

    return findings;
  }

  private validateEmptySections(
    filePath: string,
    headings: Array<{ line: number; level: number; title: string }>,
    lines: string[],
  ): ParsedComment[] {
    const findings: ParsedComment[] = [];

    for (let index = 0; index < headings.length; index++) {
      const current = headings[index];
      const nextHeadingLine = headings[index + 1]?.line ?? lines.length + 1;
      const body = lines.slice(current.line, nextHeadingLine - 1).join('\n').trim();

      if (!body) {
        findings.push(
          this.createFinding(
            filePath,
            current.line,
            'warning',
            `Section "${current.title}" masih kosong. Tambahkan isi atau hapus heading ini.`,
          ),
        );
      }
    }

    return findings;
  }

  private validateCodeFences(filePath: string, lines: string[]): ParsedComment[] {
    const fenceLines: number[] = [];

    for (const [index, line] of lines.entries()) {
      if (line.trim().startsWith('```')) {
        fenceLines.push(index + 1);
      }
    }

    if (fenceLines.length % 2 === 0) {
      return [];
    }

    const lastFenceLine = fenceLines[fenceLines.length - 1] ?? 1;
    return [this.createFinding(filePath, lastFenceLine, 'error', 'Code fence Markdown belum ditutup. Tutup blok dengan ``` agar render dokumen tidak rusak.')];
  }

  private async validateRelativeLinks(filePath: string, content: string, repoDir: string): Promise<ParsedComment[]> {
    const findings: ParsedComment[] = [];
    const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
    const baseDir = path.dirname(path.join(repoDir, filePath));
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const target = match[1].trim();
      if (!target || target.startsWith('#') || /^[a-z]+:/i.test(target)) {
        continue;
      }

      const cleanTarget = target.split('#')[0].split('?')[0];
      if (!cleanTarget) {
        continue;
      }

      const absoluteTarget = path.resolve(baseDir, cleanTarget);
      if (await fs.pathExists(absoluteTarget)) {
        continue;
      }

      const line = content.slice(0, match.index).split('\n').length;
      findings.push(
        this.createFinding(
          filePath,
          line,
          'error',
          `Link relatif "${target}" tidak mengarah ke file yang ada. Perbaiki path atau tambahkan file targetnya.`,
        ),
      );
    }

    return findings;
  }

  private validateReadmeSections(filePath: string, headings: Array<{ line: number; level: number; title: string }>): ParsedComment[] {
    const findings: ParsedComment[] = [];
    const normalizedTitles = headings.map((heading) => heading.title.toLowerCase());
    const requiredSections = [
      { name: 'setup/installasi', patterns: ['setup', 'install', 'instal', 'installation'] },
      { name: 'usage/penggunaan', patterns: ['usage', 'penggunaan', 'run', 'menjalankan', 'quick start'] },
      { name: 'configuration/konfigurasi', patterns: ['config', 'configuration', 'konfigurasi', 'environment', 'env'] },
    ];

    for (const section of requiredSections) {
      const exists = section.patterns.some((pattern) => normalizedTitles.some((title) => title.includes(pattern)));
      if (!exists) {
        findings.push(
          this.createFinding(
            filePath,
            1,
            'info',
            `README belum menjelaskan bagian ${section.name}. Tambahkan section itu supaya pengguna tahu cara memakai perubahan ini.`,
          ),
        );
      }
    }

    return findings;
  }

  private isReadme(filePath: string): boolean {
    return path.basename(filePath).toLowerCase() === 'readme.md';
  }

  private createFinding(filePath: string, lineNumber: number, severity: ParsedComment['severity'], message: string): ParsedComment {
    return {
      file_path: filePath,
      line_number: lineNumber,
      issue_type: 'quality',
      severity,
      message,
      is_auto_fixable: false,
    };
  }
}
