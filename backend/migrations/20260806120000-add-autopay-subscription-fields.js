'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // Add AutoPay fields to organizations
    await queryInterface.addColumn('organizations', 'razorpay_subscription_id', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('organizations', 'razorpay_plan_id', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('organizations', 'auto_pay_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('organizations', 'subscription_cycle', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });

    // Add razorpay_subscription_id to transactions
    await queryInterface.addColumn('transactions', 'razorpay_subscription_id', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('organizations', 'razorpay_subscription_id');
    await queryInterface.removeColumn('organizations', 'razorpay_plan_id');
    await queryInterface.removeColumn('organizations', 'auto_pay_enabled');
    await queryInterface.removeColumn('organizations', 'subscription_cycle');
    await queryInterface.removeColumn('transactions', 'razorpay_subscription_id');
  }
};
