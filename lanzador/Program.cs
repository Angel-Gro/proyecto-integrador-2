using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Drawing;
using System.Windows.Forms;

ApplicationConfiguration.Initialize();
Application.Run(new Ventana());

sealed class Ventana : Form
{
    private Process? servidor;
    private string? direccion;
    private readonly Label estado = new() { Text = "Iniciando la aplicación local...", AutoSize = false, Dock = DockStyle.Top, Height = 55, TextAlign = ContentAlignment.MiddleCenter };
    private readonly Button abrir = new() { Text = "Abrir en el navegador", Enabled = false, Dock = DockStyle.Top, Height = 45 };
    private readonly Button cerrar = new() { Text = "Cerrar aplicación", Dock = DockStyle.Top, Height = 45 };

    public Ventana()
    {
        Text = "Zona de Repartidores";
        Width = 390;
        Height = 210;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        Controls.Add(cerrar);
        Controls.Add(abrir);
        Controls.Add(estado);
        abrir.Click += (_, _) => AbrirNavegador();
        cerrar.Click += (_, _) => Close();
        Shown += async (_, _) => await Iniciar();
        FormClosing += (_, _) => {
            try { if (servidor is { HasExited: false }) servidor.Kill(true); } catch { }
            servidor?.Dispose();
        };
    }

    private async Task Iniciar()
    {
        try
        {
            var carpeta = AppContext.BaseDirectory;
            var node = Path.Combine(carpeta, "runtime", "node.exe");
            var codigo = Path.Combine(carpeta, "servidor-local.mjs");
            if (!File.Exists(node) || !File.Exists(codigo)) throw new FileNotFoundException("Faltan archivos de la aplicación. Extrae el paquete completo antes de abrirlo.");
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var puerto = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            direccion = $"http://127.0.0.1:{puerto}/";
            servidor = Process.Start(new ProcessStartInfo(node, $"\"{codigo}\" {puerto}") {
                WorkingDirectory = carpeta,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            }) ?? throw new Exception("No se pudo iniciar el servidor local.");
            using var cliente = new HttpClient();
            var listo = false;
            for (var intento = 0; intento < 40; intento++) {
                if (servidor.HasExited) break;
                try { if ((await cliente.GetAsync(direccion + "salud")).IsSuccessStatusCode) { listo = true; break; } } catch { }
                await Task.Delay(250);
            }
            if (!listo) throw new Exception("El servidor local no respondió. Revisa que los archivos estén completos.");
            estado.Text = "Aplicación lista. Los datos se guardan en esta computadora.";
            abrir.Enabled = true;
            AbrirNavegador();
        }
        catch (Exception e) { estado.Text = e.Message; MessageBox.Show(e.Message, "No se pudo iniciar", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    private void AbrirNavegador()
    {
        if (direccion != null) Process.Start(new ProcessStartInfo(direccion) { UseShellExecute = true });
    }
}
