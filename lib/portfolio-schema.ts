import {
  sqliteTable,
  integer,
  text,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const portfolioMeta = sqliteTable('portfolio_meta', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull().default(0),
  token: text('token').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});
export const portfolioSites = sqliteTable('portfolio_sites', {
  siteId: text('site_id').primaryKey(),
  body: text('body').notNull(),
});

export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  version: integer('version').primaryKey(),
  updatedAt: text('updated_at').notNull(),
});
export const portfolioRevisionSites = sqliteTable(
  'portfolio_revision_sites',
  {
    version: integer('version').notNull(),
    siteId: text('site_id').notNull(),
    body: text('body').notNull(),
  },
  (table) => [primaryKey({ columns: [table.version, table.siteId] })],
);

export const inspectionPhotos = sqliteTable('inspection_photos', {
  id: text('id').primaryKey(),
  siteId: text('site_id').notNull(),
  objectKey: text('object_key').notNull(),
  metadata: text('metadata').notNull(),
  portfolioVersion: integer('portfolio_version').notNull(),
  sharedAt: text('shared_at').notNull(),
});

export const sharedSurveys = sqliteTable('shared_surveys', {
  siteId: text('site_id').primaryKey(),
  version: integer('version').notNull(),
  objectKey: text('object_key'),
  metadata: text('metadata'),
  updatedAt: text('updated_at').notNull(),
});

export const networkObservations = sqliteTable('network_observations', {
  entityKey: text('entity_key').primaryKey(),
  observedAt: text('observed_at').notNull(),
  body: text('body').notNull(),
  receivedAt: text('received_at').notNull(),
});
