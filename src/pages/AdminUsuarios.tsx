import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Shield, UserPlus, Trash2, AlertCircle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { Navigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  roles: AppRole[];
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  produccion: 'Producción',
  finanzas: 'Finanzas',
  ventas: 'Ventas',
  almacen: 'Almacén',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-red-100 text-red-800 border-red-200',
  produccion: 'bg-green-100 text-green-800 border-green-200',
  finanzas: 'bg-blue-100 text-blue-800 border-blue-200',
  ventas: 'bg-purple-100 text-purple-800 border-purple-200',
  almacen: 'bg-amber-100 text-amber-800 border-amber-200',
};

export default function AdminUsuarios() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Record<string, AppRole>>({});

  // Redirect non-admin users
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Fetch all users with their roles
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // First get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Group roles by user_id
      const rolesByUser: Record<string, AppRole[]> = {};
      rolesData?.forEach(r => {
        if (!rolesByUser[r.user_id]) {
          rolesByUser[r.user_id] = [];
        }
        rolesByUser[r.user_id].push(r.role);
      });

      // Get unique user IDs from roles table
      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];

      // For users without roles, we need to check auth.users
      // We'll use the edge function or RPC for this in a real scenario
      // For now, show users that have roles
      const usersWithRoles: UserWithRoles[] = userIds.map(userId => ({
        id: userId,
        email: `Usuario ${userId.substring(0, 8)}...`, // Placeholder
        created_at: new Date().toISOString(),
        roles: rolesByUser[userId] || [],
      }));

      return usersWithRoles;
    },
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Rol asignado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al asignar rol: ' + error.message);
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Rol eliminado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar rol: ' + error.message);
    },
  });

  const handleAddRole = (userId: string) => {
    const role = selectedRole[userId];
    if (!role) {
      toast.error('Selecciona un rol primero');
      return;
    }
    addRoleMutation.mutate({ userId, role });
    setSelectedRole(prev => ({ ...prev, [userId]: undefined as any }));
  };

  const getAvailableRoles = (currentRoles: AppRole[]): AppRole[] => {
    const allRoles: AppRole[] = ['admin', 'produccion', 'finanzas', 'ventas', 'almacen'];
    return allRoles.filter(role => !currentRoles.includes(role));
  };

  return (
    <MainLayout title="Gestión de Usuarios" subtitle="Administra roles y permisos">
      <div className="space-y-6">

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.roles.includes('admin')).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin Rol</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users?.filter(u => u.roles.length === 0).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuarios Registrados</CardTitle>
            <CardDescription>
              Lista de usuarios con sus roles asignados. Puedes agregar o quitar roles según sea necesario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <AlertCircle className="h-12 w-12 mx-auto mb-2" />
                <p>Error al cargar usuarios</p>
              </div>
            ) : users && users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID de Usuario</TableHead>
                    <TableHead>Roles Actuales</TableHead>
                    <TableHead>Agregar Rol</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(userItem => (
                    <TableRow key={userItem.id}>
                      <TableCell className="font-mono text-sm">
                        {userItem.id.substring(0, 8)}...
                        {userItem.id === user?.id && (
                          <Badge variant="outline" className="ml-2">Tú</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {userItem.roles.length > 0 ? (
                            userItem.roles.map(role => (
                              <div key={role} className="flex items-center gap-1">
                                <Badge className={ROLE_COLORS[role]}>
                                  {ROLE_LABELS[role]}
                                </Badge>
                                {userItem.id !== user?.id && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        disabled={removeRoleMutation.isPending}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esto eliminará el rol "{ROLE_LABELS[role]}" del usuario. 
                                          El usuario perderá acceso a las funciones asociadas a este rol.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => removeRoleMutation.mutate({ userId: userItem.id, role })}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Eliminar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning/30">
                              Sin roles
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedRole[userItem.id] || ''}
                            onValueChange={(value) => 
                              setSelectedRole(prev => ({ ...prev, [userItem.id]: value as AppRole }))
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableRoles(userItem.roles).map(role => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleAddRole(userItem.id)}
                            disabled={!selectedRole[userItem.id] || addRoleMutation.isPending}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Agregar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay usuarios registrados aún</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">Guía de Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(ROLE_LABELS) as AppRole[]).map(role => (
                <div key={role} className="flex items-start gap-3 p-3 rounded-lg bg-background">
                  <Badge className={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                  <div className="text-sm text-muted-foreground">
                    {role === 'admin' && 'Acceso completo a todas las funciones del sistema.'}
                    {role === 'produccion' && 'Gestión de lotes, cortadores, huertos y producción.'}
                    {role === 'finanzas' && 'Gestión de productores, anticipos, liquidaciones y pagos.'}
                    {role === 'ventas' && 'Gestión de clientes, ventas y presentaciones.'}
                    {role === 'almacen' && 'Gestión de inventario, insumos y cámara fría.'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
