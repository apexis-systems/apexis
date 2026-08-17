import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface) => {
    await queryInterface.addColumn('transactions', 'is_superadmin_activated', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('transactions', 'is_superadmin_activated').catch(() => {});
  }
};
