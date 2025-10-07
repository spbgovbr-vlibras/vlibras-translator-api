import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Review extends Model {
    static associate(models) {
      models.Review.belongsTo(models.Translation, { foreignKey: 'translationId' });
    }
  }

  Review.init(
    {
      translationId: { type: DataTypes.INTEGER, allowNull: false },
      rating: { type: DataTypes.BOOLEAN, allowNull: false },
      review: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
          len: [0, 25000],
        },
      },
      requester: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'Review',
      indexes: [{ fields: ['translationId'] }],
    }
  );

  return Review;
};
