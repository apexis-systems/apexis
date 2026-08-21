import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface) => {
    await queryInterface.addColumn('transactions', 'payment_method', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    }).catch(() => {});

    await queryInterface.addColumn('transactions', 'payment_details', {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('transactions', 'payment_method').catch(() => {});
    await queryInterface.removeColumn('transactions', 'payment_details').catch(() => {});
  }
};
