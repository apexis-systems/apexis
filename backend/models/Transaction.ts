import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Transaction = sequelize.define(
        "transactions",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            organization_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            subscription_tier: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            subscription_cycle: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            payment_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            payment_order_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            payment_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            payment_signature: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            payment_status: {
                type: DataTypes.STRING,
                defaultValue: "pending",
            },
        },
        {
            tableName: "transactions",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    return Transaction;
};
