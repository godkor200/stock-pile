import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  DartCompanyResponse,
  DartFinancialStatement,
  DartDisclosure,
  DartApiResponse,
} from './interfaces/dart-response.interface';

const DART_BASE_URL = 'https://opendart.fss.or.kr';

@Injectable()
export class DartAdapter {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(DartAdapter.name);

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('DART_API_KEY', '');

    this.http = axios.create({
      baseURL: DART_BASE_URL,
      timeout: 10000,
    });

    // Intercept requests to attach crtfc_key automatically
    this.http.interceptors.request.use((reqConfig) => {
      reqConfig.params = { crtfc_key: apiKey, ...reqConfig.params };
      return reqConfig;
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        this.logger.error('DART API request failed', err?.message);
        return Promise.reject(err);
      },
    );
  }

  async getCompanyInfo(ticker: string): Promise<DartCompanyResponse | null> {
    try {
      const { data } = await this.http.get<DartCompanyResponse>(
        '/api/company.json',
        { params: { stock_code: ticker } },
      );
      return data;
    } catch (err) {
      this.logger.error(`getCompanyInfo failed for ticker=${ticker}`, err);
      return null;
    }
  }

  async getFinancialStatements(
    ticker: string,
    year: number,
  ): Promise<DartApiResponse<DartFinancialStatement> | null> {
    try {
      const { data } = await this.http.get<
        DartApiResponse<DartFinancialStatement>
      >('/api/fnlttSinglAcntAll.json', {
        params: {
          stock_code: ticker,
          bsns_year: year,
          reprt_code: '11011', // annual report
          fs_div: 'CFS', // consolidated
        },
      });
      return data;
    } catch (err) {
      this.logger.error(
        `getFinancialStatements failed for ticker=${ticker}, year=${year}`,
        err,
      );
      return null;
    }
  }

  async getRecentDisclosures(
    ticker: string,
    days: number,
  ): Promise<DartApiResponse<DartDisclosure> | null> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const format = (d: Date) =>
        d.toISOString().slice(0, 10).replace(/-/g, '');

      const { data } = await this.http.get<DartApiResponse<DartDisclosure>>(
        '/api/list.json',
        {
          params: {
            stock_code: ticker,
            bgn_de: format(startDate),
            end_de: format(endDate),
            page_count: 100,
          },
        },
      );
      return data;
    } catch (err) {
      this.logger.error(
        `getRecentDisclosures failed for ticker=${ticker}`,
        err,
      );
      return null;
    }
  }
}
