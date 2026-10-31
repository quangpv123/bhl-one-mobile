import type { AppModule } from '@/navigation/moduleTypes';
import { permissions } from '@/features/auth/permissions';

export const userModule: AppModule = {
  key: 'users',
  label: 'Người dùng',
  navigationGroup: 'system',
  features: [
    { key: 'users', title: 'Người dùng', subtitle: 'Tài khoản và trạng thái hoạt động', icon: 'users', group: 'system', permission: permissions.usersView },
    { key: 'roles', title: 'Vai trò & quyền', subtitle: 'Vai trò và tập quyền truy cập', icon: 'roles', group: 'system', permission: permissions.rolesView },
  ],
};
