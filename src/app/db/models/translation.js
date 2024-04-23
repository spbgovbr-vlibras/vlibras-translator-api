// translation.js
import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Translation extends Model {
    static associate(models) {
      models.Translation.hasMany(models.Review, {
        foreignKey: 'translationId',
      });
    }
  }
  Translation.init({
    text: {
      type: DataTypes.STRING(5000),
      allowNull: false,
      unique: true // Adicionando índice único na coluna 'text'
    },
    translation: DataTypes.STRING(5000),
    requester: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Translation',
    indexes: [
      {
        fields: ['text'] 
      }
    ]
  });
  return Translation;
};
