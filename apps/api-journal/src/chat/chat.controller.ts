import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatParseResponseDto, TradeSource } from '@stock-pile/shared-types';
import { ChatInputService } from './chat-input.service';
import { ChatSessionService } from './chat-session.service';
import { ChatMessageDto, ClarifyDto, ConfirmDto } from './dto/chat-message.dto';
import { StocksService } from '../stocks/stocks.service';
import { TradesService } from '../trades/trades.service';
import { CreateTradeDto } from '../trades/dto/create-trade.dto';
import { UsersService } from '../users/users.service';
import { ChatAdvisorService } from './chat-advisor.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatInput: ChatInputService,
    private readonly chatSession: ChatSessionService,
    private readonly stocks: StocksService,
    private readonly trades: TradesService,
    private readonly users: UsersService,
    private readonly advisor: ChatAdvisorService,
  ) {}

  @Post('parse')
  @ApiOperation({ summary: '자연어 매매 입력 파싱' })
  async parse(
    @Body() dto: ChatMessageDto,
    @Headers('x-user-id') userId: string,
  ): Promise<ChatParseResponseDto> {
    if (!userId) throw new UnauthorizedException();

    await this.users.findOrCreate(userId);

    // 1단계: 의도 분류 + 종목 추출 — 투자 질문이면 어드바이저로 라우팅
    const { intent, ticker: mentionedTicker } = await this.advisor.classify(dto.message);
    if (intent === 'INVESTMENT_QUERY') {
      const message = await this.advisor.advise(userId, dto.message, mentionedTicker);
      return {
        status: 'CHAT_RESPONSE',
        message,
        ...(mentionedTicker ? { advisedTicker: mentionedTicker } : {}),
      };
    }

    const parsed = await this.chatInput.parse(dto.message);
    const session = await this.chatSession.create(userId, parsed);

    const candidates = parsed.stockQuery
      ? await this.stocks.search(parsed.stockQuery)
      : [];

    if (candidates.length === 0) {
      if (!parsed.ticker) {
        return {
          status: 'STOCK_NOT_FOUND',
          parsed,
          sessionId: session.sessionId,
          prompt: `"${parsed.stockQuery}" 종목을 찾을 수 없습니다. 티커 코드를 직접 입력해주세요 (예: 005930).`,
        };
      }
      // 티커는 알지만 DB에 없는 경우 — 자동 등록 후 진행
      await this.stocks.ensureExists(parsed.ticker);
    }

    if (candidates.length > 1 && !parsed.ticker) {
      return {
        status: 'AMBIGUOUS_STOCK',
        parsed,
        sessionId: session.sessionId,
        candidates: candidates.map((s) => ({ ticker: s.ticker, name: s.name })),
      };
    }

    const stock = parsed.ticker
      ? ((await this.stocks.findByTicker(parsed.ticker)) ?? candidates[0])
      : candidates[0];
    parsed.ticker = stock.ticker;

    if (parsed.missingFields.length > 0) {
      return {
        status: 'NEEDS_CLARIFICATION',
        parsed,
        sessionId: session.sessionId,
        prompt: parsed.clarificationQuestion,
      };
    }

    return { status: 'READY_TO_CONFIRM', parsed, sessionId: session.sessionId };
  }

  @Post('clarify')
  @ApiOperation({ summary: '종목 선택 또는 누락 정보 보완' })
  async clarify(
    @Body() dto: ClarifyDto,
    @Headers('x-user-id') userId: string,
  ): Promise<ChatParseResponseDto> {
    if (!userId) throw new UnauthorizedException();

    await this.users.findOrCreate(userId);
    const session = await this.chatSession.update(
      dto.sessionId,
      userId,
      dto.fieldUpdates ?? {},
      dto.ticker,
    );
    const parsed = session.parsedData;

    if (parsed.missingFields.length > 0) {
      return {
        status: 'NEEDS_CLARIFICATION',
        parsed,
        sessionId: session.sessionId,
        prompt: parsed.clarificationQuestion,
      };
    }

    return { status: 'READY_TO_CONFIRM', parsed, sessionId: session.sessionId };
  }

  @Post('confirm')
  @ApiOperation({ summary: '파싱된 매매 확정 저장' })
  async confirm(
    @Body() dto: ConfirmDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) throw new UnauthorizedException();

    await this.users.findOrCreate(userId);
    const session = await this.chatSession.findActiveByUser(dto.sessionId, userId);
    const p = session.parsedData;

    const createDto: CreateTradeDto = {
      ticker: p.ticker!,
      side: p.side!,
      quantity: p.quantity!,
      price: p.price ?? 0,
      tradedAt: new Date().toISOString(),
      reason: p.reason,
      emotion: p.emotion,
      tags: [],
      source: TradeSource.CHATBOT,
    };

    const trade = await this.trades.createFromChat(userId, createDto);
    await this.chatSession.confirm(dto.sessionId, userId);
    return trade;
  }
}
