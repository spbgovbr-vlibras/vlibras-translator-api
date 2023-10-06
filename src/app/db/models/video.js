'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Video extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Video.init({
    gloss: DataTypes.STRING,
    uid: DataTypes.STRING,
    path: DataTypes.STRING,
    size: DataTypes.FLOAT,
    duration: DataTypes.FLOAT,
    status: DataTypes.STRING,
    requester: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Video',
  });
  return Video;
};