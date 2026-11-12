import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import { fechaHora } from "../../api/formato.js";
import { CajaError, Cargando, Sello } from "../../componentes/comunes.jsx";

const TONO_ROL = { admin: "rio", vendedor: "aviso", cliente: "neutro" };

export default function Usuarios() {
  const [lista, setLista] = useState(null);
  const [rol, setRol] = useState("");
  const [error, setError] = useState(null);
  useEffect(() => { api("/usuarios").then((r) => setLista(r.datos || [])).catch(setError); }, []);

  const visibles = (lista || []).filter((u) => !rol || u.rol === rol);
  const cuenta = (r) => (lista || []).filter((u) => u.rol === r).length;
  const filtros = [["", "Todos", lista?.length ?? 0], ["cliente", "Clientes", cuenta("cliente")], ["vendedor", "Vendedores", cuenta("vendedor")], ["admin", "Admin", cuenta("admin")]];

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <div>
          <h2>Usuarios</h2>
          <p className="secundario">Cuentas del servicio de usuarios. Las contraseñas se guardan con bcrypt y nunca salen de ese servicio.</p>
        </div>
        <div className="segmentado" role="group" aria-label="Filtrar por rol">
          {filtros.map(([v, t, n]) => (
            <button key={v} className={rol === v ? "activo" : ""} aria-pressed={rol === v} onClick={() => setRol(v)}>{t} {n}</button>
          ))}
        </div>
      </div>
      <CajaError error={error} />
      {!lista ? <Cargando alto={240} /> : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Ciudad</th><th>Registro</th></tr></thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong>{!u.activo && <span className="secundario"> (inactivo)</span>}</td>
                  <td className="mono">{u.email}</td>
                  <td><Sello tono={TONO_ROL[u.rol]} plano>{u.rol}</Sello></td>
                  <td>{u.ciudad || <span className="secundario">Sin ciudad</span>}</td>
                  <td className="secundario">{fechaHora(u.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
