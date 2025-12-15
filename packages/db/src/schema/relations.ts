import { relations } from 'drizzle-orm';
import { groups } from './groups';
import { summaries } from './summaries';
import { summaryJobs } from './summary-jobs';
import { telegramAccounts } from './telegram-accounts';

// TelegramAccounts relations
export const telegramAccountsRelations = relations(telegramAccounts, ({ many }) => ({
  groups: many(groups),
}));

// Groups relations
export const groupsRelations = relations(groups, ({ one, many }) => ({
  account: one(telegramAccounts, {
    fields: [groups.accountId],
    references: [telegramAccounts.id],
  }),
  summaries: many(summaries),
  summaryJobs: many(summaryJobs),
}));

// Summaries relations
export const summariesRelations = relations(summaries, ({ one }) => ({
  group: one(groups, {
    fields: [summaries.groupId],
    references: [groups.id],
  }),
}));

// SummaryJobs relations
export const summaryJobsRelations = relations(summaryJobs, ({ one }) => ({
  group: one(groups, {
    fields: [summaryJobs.groupId],
    references: [groups.id],
  }),
}));
