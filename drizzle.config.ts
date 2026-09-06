import {defineConfig} from 'drizzle-kit';
export default defineConfig({schema:'./lib/portfolio-schema.ts',out:'./drizzle',dialect:'sqlite'});
