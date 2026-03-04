import { DataTypes, Model } from 'sequelize';

export default (sequelize: any, dataTypes: typeof DataTypes) => {
    class activities extends Model { }
    activities.init({
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        project_id: { type: dataTypes.INTEGER, allowNull: true },
        user_id: { type: dataTypes.INTEGER, allowNull: false },
        type: { type: dataTypes.ENUM('upload', 'edit', 'delete', 'share', 'upload_photo'), allowNull: false },
        description: { type: dataTypes.STRING, allowNull: false },
    }, {
        sequelize,
        modelName: 'activities',
        tableName: 'activities',
    });
    return activities;
};
