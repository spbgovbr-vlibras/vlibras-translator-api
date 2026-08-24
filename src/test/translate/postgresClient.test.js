import { describe, expect, it } from '@jest/globals';

import { buildClientConfig } from '../../app/db/postgresClient.js';
import sequelizeConfig from '../../app/db/config/config.js';

describe('Standalone Postgres client config', () => {
  it('should map the sequelize credentials to the driver options', () => {
    expect(buildClientConfig({
      username: 'vlibras',
      password: 'secret',
      database: 'vlibrasdb',
      host: 'postgres',
      port: 5432,
      dialect: 'postgres',
    })).toEqual({
      user: 'vlibras',
      password: 'secret',
      database: 'vlibrasdb',
      host: 'postgres',
      port: 5432,
    });
  });

  it('should carry the production ssl options over to the driver', () => {
    const clientConfig = buildClientConfig(sequelizeConfig.production);

    expect(clientConfig.ssl).toEqual({ require: true, rejectUnauthorized: false });
  });

  it('should prefer the connection string when the environment defines one', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';

    expect(buildClientConfig({
      use_env_variable: 'DATABASE_URL',
      dialectOptions: { ssl: { require: true } },
    })).toEqual({
      connectionString: 'postgres://user:pass@host:5432/db',
      ssl: { require: true },
    });

    delete process.env.DATABASE_URL;
  });
});
