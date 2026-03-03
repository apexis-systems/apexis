import { DataTypes, Model } from 'sequelize';

export default (sequelize: any, dataTypes: typeof DataTypes) => {
    class reports extends Model { }
    reports.init({
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        project_id: { type: dataTypes.INTEGER, allowNull: false },
        type: { type: dataTypes.ENUM('daily', 'weekly'), allowNull: false },
        period_start: { type: dataTypes.DATEONLY, allowNull: false },
        period_end: { type: dataTypes.DATEONLY, allowNull: false },
        photos_count: { type: dataTypes.INTEGER, defaultValue: 0 },
        docs_count: { type: dataTypes.INTEGER, defaultValue: 0 },
        releases_count: { type: dataTypes.INTEGER, defaultValue: 0 },
        comments_count: { type: dataTypes.INTEGER, defaultValue: 0 },
        summary: { type: dataTypes.JSONB, allowNull: true },
    }, {
        sequelize,
        modelName: 'reports',
        tableName: 'reports',
    });
    return reports;
};
