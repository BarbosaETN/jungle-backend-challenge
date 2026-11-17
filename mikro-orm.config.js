"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const postgresql_1 = require("@mikro-orm/postgresql");
exports.default = (0, postgresql_1.defineConfig)({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    dbName: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    entities: ['./dist/**/*.entity.js'],
    entitiesTs: ['./src/**/*.entity.ts'],
    migrations: {
        path: './dist/database/migrations',
        pathTs: './src/database/migrations',
    },
});
//# sourceMappingURL=mikro-orm.config.js.map