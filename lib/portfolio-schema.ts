import {sqliteTable,integer,text} from 'drizzle-orm/sqlite-core';
export const portfolioMeta=sqliteTable('portfolio_meta',{id:integer('id').primaryKey(),version:integer('version').notNull().default(0),token:text('token').notNull().default(''),updatedAt:text('updated_at').notNull().default('')});
export const portfolioSites=sqliteTable('portfolio_sites',{siteId:text('site_id').primaryKey(),body:text('body').notNull()});
