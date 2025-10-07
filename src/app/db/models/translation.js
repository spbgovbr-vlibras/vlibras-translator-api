import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Translation extends Model {
    static associate(models) {
      models.Translation.hasMany(models.Review, { foreignKey: 'translationId' });
    }
  }

  Translation.init(
    {
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: { len: [1, 25000] },
      },
      translation: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: { len: [0, 25000] },
      },
      requester: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'Translation',
    }
  );

  return Translation;
};
