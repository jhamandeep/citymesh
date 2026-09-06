import {sqliteTable,integer,text,primaryKey} from 'drizzle-orm/sqlite-core';
export const portfolioMeta=sqliteTable('portfolio_meta',{id:integer('id').primaryKey(),version:integer('version').notNull().default(0),token:text('token').notNull().default(''),updatedAt:text('updated_at').notNull().default('')});
export const portfolioSites=sqliteTable('portfolio_sites',{siteId:text('site_id').primaryKey(),body:text('body').notNull()});

export const portfolioSnapshots=sqliteTable('portfolio_snapshots',{version:integer('version').primaryKey(),updatedAt:text('updated_at').notNull()});
export const portfolioRevisionSites=sqliteTable('portfolio_revision_sites',{version:integer('version').notNull(),siteId:text('site_id').notNull(),body:text('body').notNull()},table=>[primaryKey({columns:[table.version,table.siteId]})]);

