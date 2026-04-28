import { Injectable, Logger } from '@nestjs/common';
import { DartAdapter } from './dart.adapter';
import { RedisCacheService } from '../common/redis-cache.service';
import {
  DartCompanyResponse,
  DartFinancialStatement,
  DartDisclosure,
  DartApiResponse,
} from './interfaces/dart-response.interface';

const CACHE_TTL = 3600;

@Injectable()
export class DartService {
  private readonly logger = new Logger(DartService.name);

  constructor(
    private readonly dartAdapter: DartAdapter,
    private readonly cache: RedisCacheService,
  ) {}

  async getCompanyInfo(ticker: string): Promise<DartCompanyResponse | null> {
    const key = `dart:companyInfo:${ticker}`;
    const cached = await this.cache.get<DartCompanyResponse>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    try {
      const data = await this.dartAdapter.getCompanyInfo(ticker);
      if (data !== null) {
        await this.cache.set(key, data, CACHE_TTL);
      }
      return data;
    } catch (err) {
      this.logger.error(`getCompanyInfo error for ticker=${ticker}`, err);
      // retry once
      try {
        const data = await this.dartAdapter.getCompanyInfo(ticker);
        if (data !== null) {
          await this.cache.set(key, data, CACHE_TTL);
        }
        return data;
      } catch {
        return null;
      }
    }
  }

  async getFinancialStatements(
    ticker: string,
    year: number,
  ): Promise<DartApiResponse<DartFinancialStatement> | null> {
    const key = `dart:financialStatements:${ticker}:${year}`;
    const cached =
      await this.cache.get<DartApiResponse<DartFinancialStatement>>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    try {
      const data = await this.dartAdapter.getFinancialStatements(ticker, year);
      if (data !== null) {
        await this.cache.set(key, data, CACHE_TTL);
      }
      return data;
    } catch (err) {
      this.logger.error(
        `getFinancialStatements error for ticker=${ticker}, year=${year}`,
        err,
      );
      // retry once
      try {
        const data = await this.dartAdapter.getFinancialStatements(
          ticker,
          year,
        );
        if (data !== null) {
          await this.cache.set(key, data, CACHE_TTL);
        }
        return data;
      } catch {
        return null;
      }
    }
  }

  async getRecentDisclosures(
    ticker: string,
    days: number,
  ): Promise<DartApiResponse<DartDisclosure> | null> {
    const key = `dart:recentDisclosures:${ticker}:${days}`;
    const cached =
      await this.cache.get<DartApiResponse<DartDisclosure>>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit: ${key}`);
      return cached;
    }

    try {
      const data = await this.dartAdapter.getRecentDisclosures(ticker, days);
      if (data !== null) {
        await this.cache.set(key, data, CACHE_TTL);
      }
      return data;
    } catch (err) {
      this.logger.error(
        `getRecentDisclosures error for ticker=${ticker}`,
        err,
      );
      // retry once
      try {
        const data = await this.dartAdapter.getRecentDisclosures(ticker, days);
        if (data !== null) {
          await this.cache.set(key, data, CACHE_TTL);
        }
        return data;
      } catch {
        return null;
      }
    }
  }
}
