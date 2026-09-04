import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { NotFound, RequiereSesion, SoloOperador, SoloRevendedora } from './components/layout/Gates';
import { Dashboard } from './features/dashboard/Dashboard';
import { ResellerList } from './features/resellers/ResellerList';
import { ResellerDetail } from './features/resellers/ResellerDetail';
import { AccountList } from './features/accounts/AccountList';
import { AccountDetail } from './features/accounts/AccountDetail';
import { CustomerList } from './features/customers/CustomerList';
import { CustomerDetail } from './features/customers/CustomerDetail';
import { CustomerForm } from './features/customers/CustomerForm';
import { DeviceList } from './features/devices/DeviceList';
import { DeviceDetail } from './features/devices/DeviceDetail';
import { CommercialPlanList } from './features/commercial-plans/CommercialPlanList';
import { CommercialPlanDetail } from './features/commercial-plans/CommercialPlanDetail';
import { TeamMemberList } from './features/team-members/TeamMemberList';
import { AuditLogList } from './features/audit-log/AuditLogList';
import { ReportsView } from './features/reports/ReportsView';
import { SettingsView } from './features/settings/SettingsView';
import { ResellerSettingsView } from './features/settings/ResellerSettingsView';
import { LandingPage } from './features/landing/LandingPage';
import { useSesion } from './lib/session';

const SettingsPage = () => {
  const { esOperador } = useSesion();
  return esOperador ? <SettingsView /> : <ResellerSettingsView />;
};

/**
 * =============================================================================
 * Rutas del panel
 * =============================================================================
 * Convención (docs/IPTVControl_URL_Routing_Convention.md):
 *  - Sustantivos en plural, en inglés genérico, kebab-case si son compuestos.
 *  - Anidamiento de un nivel como máximo: la relación Cuenta → Dispositivo se
 *    resuelve con `?account_id=`, no con `/accounts/:id/devices/:id`. Si un
 *    dispositivo migra de cuenta, los enlaces guardados siguen funcionando.
 *  - Multi-tenancy invisible: la misma ruta sirve a los dos paneles y el scope
 *    lo define el token.
 *
 * `/customers/new` es la única ruta que no representa un recurso: es el wizard de
 * alta, y va antes de `/customers/:id` para que "new" no se interprete como un ID.
 * =============================================================================
 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route
      element={
        <RequiereSesion>
          <AppLayout />
        </RequiereSesion>
      }
    >
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Empresas Revendedoras — sólo Operador Principal */}
      <Route
        path="/resellers"
        element={
          <SoloOperador>
            <ResellerList />
          </SoloOperador>
        }
      />
      <Route
        path="/resellers/:id"
        element={
          <SoloOperador>
            <ResellerDetail />
          </SoloOperador>
        }
      />

      {/* Cuentas y Dispositivos — ambos paneles, con campos distintos */}
      <Route path="/accounts" element={<AccountList />} />
      <Route path="/accounts/:id" element={<AccountDetail />} />
      <Route path="/devices" element={<DeviceList />} />
      <Route path="/devices/:id" element={<DeviceDetail />} />

      {/* Clientes Finales */}
      <Route path="/customers" element={<CustomerList />} />
      <Route
        path="/customers/new"
        element={
          <SoloRevendedora>
            <CustomerForm />
          </SoloRevendedora>
        }
      />
      <Route path="/customers/:id" element={<CustomerDetail />} />

      {/* Modalidades comerciales: el Operador las administra, la Empresa
          Revendedora ve sus precios vigentes en la misma ruta */}
      <Route path="/commercial-plans" element={<CommercialPlanList />} />
      <Route path="/commercial-plans/:id" element={<CommercialPlanDetail />} />

      <Route
        path="/reports"
        element={
          <SoloOperador>
            <ReportsView />
          </SoloOperador>
        }
      />
      {/* Compatibilidad: Proveedores ahora vive dentro de Configuración. */}
      <Route
        path="/providers"
        element={
          <SoloOperador>
            <Navigate to="/settings?section=providers" replace />
          </SoloOperador>
        }
      />
      <Route path="/settings" element={<SettingsPage />} />

      <Route path="/audit-log" element={<AuditLogList />} />
      <Route path="/team-members" element={<TeamMemberList />} />

      {/* Destino del enlace de invitación de Auth0 tras definir la contraseña */}
      <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
