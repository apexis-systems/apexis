'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transactions', 'invoice_number', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex('transactions', ['invoice_number'], {
      unique: true,
      name: 'transactions_invoice_number_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('transactions', 'transactions_invoice_number_unique');
    await queryInterface.removeColumn('transactions', 'invoice_number');
  }
};
