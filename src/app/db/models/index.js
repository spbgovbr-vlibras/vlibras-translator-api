import { Sequelize, DataTypes } from 'sequelize';
import config from '../config/config.js';
import HitFactory from './hit.js';
import ReviewFactory from './review.js';
import TranslationFactory from './translation.js';

const env = process.env.NODE_ENV || 'dev';


const sequelizeConfig = config[env];
const db = {};



let sequelize;
if (sequelizeConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[sequelizeConfig.use_env_variable], sequelizeConfig);
} else {
  sequelize = new Sequelize(sequelizeConfig.database, sequelizeConfig.username, sequelizeConfig.password, sequelizeConfig);
}

// Inicializa modelos
const Hit = HitFactory(sequelize, DataTypes);
const Review = ReviewFactory(sequelize, DataTypes);
const Translation = TranslationFactory(sequelize, DataTypes);

// Configuração das associações
Translation.associate({ Translation, Review });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default { sequelize, Sequelize, Hit, Review, Translation};
