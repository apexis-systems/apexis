import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Plan = sequelize.define(
        "plans",
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
            price: {
                type: DataTypes.DECIMAL,
                allowNull: false,
            },
            storage_limit_mb: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            duration_days: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            project_limit: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            contributor_limit: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 2,
            },
            client_limit: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            max_snags: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 15,
            },
            max_rfis: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 15,
            },
            can_export_reports: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            can_share_media: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            can_export_handover: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        },
        {
            tableName: "plans",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    return Plan;
};
