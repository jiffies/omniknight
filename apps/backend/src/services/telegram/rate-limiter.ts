import { logger } from '../../utils/logger';

/**
 * 激进自适应限流控制器
 *
 * 策略：
 * - 从1000条/批开始（激进）
 * - 遇到限流逐级降低：1000 → 500 → 300 → 100
 * - 自适应调整等待时间
 */

interface RateLimiterConfig {
  // 降级阶梯
  batchSizeSteps: number[]; // 批次大小阶梯
  waitMsSteps: number[]; // 对应的等待时间

  minBatchSize: number; // 最小批次
  maxWaitMs: number; // 最大等待时间

  floodBackoffFactor: number; // 遇限流后增加等待时间的倍数
  maxConsecutiveFloods: number; // 最多连续限流次数
  cooldownPeriodMs: number; // 冷却期（毫秒）
}

interface RateLimiterState {
  currentBatchSize: number;
  currentWaitMs: number;
  currentStepIndex: number; // 当前阶梯索引
  consecutiveSuccesses: number;
  consecutiveFloods: number;
  lastFloodWait: number; // 上次限流时间戳
}

export class RateLimiter {
  private config: RateLimiterConfig = {
    // 激进策略：从大到小
    batchSizeSteps: [1000, 500, 300, 100],
    waitMsSteps: [2000, 3000, 4000, 5000],

    minBatchSize: 50,
    maxWaitMs: 60000, // 1分钟

    floodBackoffFactor: 1.5,
    maxConsecutiveFloods: 5,
    cooldownPeriodMs: 300000, // 5分钟
  };

  private state: RateLimiterState = {
    currentBatchSize: 1000, // 从最大开始
    currentWaitMs: 2000,
    currentStepIndex: 0,
    consecutiveSuccesses: 0,
    consecutiveFloods: 0,
    lastFloodWait: 0,
  };

  /**
   * 计算当前等待时间
   */
  calculateWait(): number {
    return Math.min(this.config.maxWaitMs, this.state.currentWaitMs);
  }

  /**
   * 获取当前批次大小
   */
  getBatchSize(): number {
    return Math.max(this.config.minBatchSize, this.state.currentBatchSize);
  }

  /**
   * 成功回调 - 保持当前速率
   */
  onSuccess(): void {
    this.state.consecutiveSuccesses++;
    this.state.consecutiveFloods = 0;

    logger.debug('批次成功', {
      batchSize: this.state.currentBatchSize,
      waitMs: this.state.currentWaitMs,
      stepIndex: this.state.currentStepIndex,
      consecutiveSuccesses: this.state.consecutiveSuccesses,
    });
  }

  /**
   * 限流回调 - 降级并退避
   */
  async onFloodWait(waitSeconds: number): Promise<void> {
    this.state.consecutiveFloods++;
    this.state.consecutiveSuccesses = 0;
    this.state.lastFloodWait = Date.now();

    logger.warn('触发 FLOOD_WAIT', {
      waitSeconds,
      currentBatchSize: this.state.currentBatchSize,
      currentStepIndex: this.state.currentStepIndex,
      consecutiveFloods: this.state.consecutiveFloods,
    });

    // 检查是否需要冷却
    if (this.state.consecutiveFloods >= this.config.maxConsecutiveFloods) {
      throw new Error(`连续触发 ${this.state.consecutiveFloods} 次 FLOOD_WAIT，进入冷却期`);
    }

    // 降低一个等级
    this.downgradeTier();

    // 增加等待时间
    this.state.currentWaitMs = Math.floor(
      this.state.currentWaitMs * this.config.floodBackoffFactor,
    );

    // 等待 Telegram 要求的时间（加10%缓冲）
    const actualWaitMs = waitSeconds * 1000 * 1.1;
    logger.info(`等待 ${(actualWaitMs / 1000).toFixed(1)} 秒后重试`);
    await this.sleep(actualWaitMs);
  }

  /**
   * 降低一个等级
   */
  downgradeTier(): void {
    if (this.state.currentStepIndex < this.config.batchSizeSteps.length - 1) {
      this.state.currentStepIndex++;

      const newBatchSize =
        this.config.batchSizeSteps[this.state.currentStepIndex] ?? this.config.minBatchSize;
      const newWaitMs =
        this.config.waitMsSteps[this.state.currentStepIndex] ?? this.config.maxWaitMs;

      logger.warn('降级限流等级', {
        oldBatchSize: this.state.currentBatchSize,
        newBatchSize,
        oldWaitMs: this.state.currentWaitMs,
        newWaitMs,
        stepIndex: this.state.currentStepIndex,
      });

      this.state.currentBatchSize = newBatchSize;
      this.state.currentWaitMs = newWaitMs;
    } else {
      // 已经是最低等级，只能减小批次大小
      const reducedBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(this.state.currentBatchSize * 0.5),
      );

      logger.warn('已达最低等级，减小批次', {
        oldBatchSize: this.state.currentBatchSize,
        newBatchSize: reducedBatchSize,
      });

      this.state.currentBatchSize = reducedBatchSize;
    }
  }

  /**
   * 获取当前状态（用于日志记录）
   */
  getState(): Readonly<RateLimiterState> {
    return { ...this.state };
  }

  /**
   * 重置状态（可选，用于新的拉取任务）
   */
  reset(): void {
    this.state = {
      currentBatchSize: this.config.batchSizeSteps[0] ?? 1000,
      currentWaitMs: this.config.waitMsSteps[0] ?? 2000,
      currentStepIndex: 0,
      consecutiveSuccesses: 0,
      consecutiveFloods: 0,
      lastFloodWait: 0,
    };

    logger.info('限流控制器已重置');
  }

  /**
   * 辅助函数：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
