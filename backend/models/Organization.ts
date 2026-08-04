import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Organization = sequelize.define(
        "organizations",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            logo: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            plan_name: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "Free",
            },
            plan_price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.00,
            },
            seats_purchased: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            price_per_seat: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 159.00,
            },
            plan_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            plan_start_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            plan_end_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            storage_used_mb: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            storage_limit_mb: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 100,
            },
            restrict_onboarding: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        {
            tableName: "organizations",
            timestamps: true,
        }
    );

    return Organization;
};
