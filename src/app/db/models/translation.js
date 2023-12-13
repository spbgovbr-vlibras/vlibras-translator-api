'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Translation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      models.Translation.hasMany(models.Review, {
        foreignKey: 'translationId',
      });
    }
  }
  Translation.init({
    text: DataTypes.STRING,
    translation: DataTypes.STRING,
    requester: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Translation',
  });
  return Translation;
};