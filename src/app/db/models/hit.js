'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Hit extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Hit.init({
    text: DataTypes.STRING,
    hits: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Hit',
  });
  return Hit;
};