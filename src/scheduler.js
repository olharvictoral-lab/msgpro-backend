// scheduler.js — Processa agendamentos pendentes a cada minuto
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const db   = require('./database');
const wpMgr = require('./whatsapp-manager');
const tgMgr = require('./telegram-manager');

// Roda a cada 1 minuto
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString().slice(0, 16); // "2024-01-15T14:30"

    const pendentes = db.prepare(`
      SELECT * FROM schedules
      WHERE status = 'pending'
        AND substr(scheduled_at, 1, 16) <= ?
    `).all(now);

    if (pendentes.length === 0) return;

    console.log(`⏰ Scheduler: ${pendentes.length} agendamento(s) para processar`);

    for (const job of pendentes) {
      // Marca como 'sending' para não processar duas vezes
      db.prepare(`UPDATE schedules SET status = 'sending' WHERE id = ?`).run(job.id);

      try {
        const destinations = JSON.parse(job.destinations);
        let results = [];

        if (job.platform === 'whatsapp') {
          results = await wpMgr.sendToGroups(destinations, job.message, job.delay_seconds);
        } else if (job.platform === 'telegram') {
          results = await tgMgr.sendToGroups(destinations, job.message);
        }

        // Salva log de cada envio
        const logStmt = db.prepare(`
          INSERT INTO send_log (id, schedule_id, platform, destination, status, error)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        results.forEach(r => {
          logStmt.run(uuidv4(), job.id, job.platform, r.id, r.ok ? 'sent' : 'error', r.error || null);
        });

        const allOk = results.every(r => r.ok);
        db.prepare(`UPDATE schedules SET status = ?, sent_at = datetime('now') WHERE id = ?`)
          .run(allOk ? 'sent' : 'partial', job.id);

        console.log(`✅ Job ${job.id} concluído — ${results.filter(r=>r.ok).length}/${results.length} enviados`);

        // Reagendar se for recorrente
        if (job.repeat_type !== 'once') {
          const nextDate = calcNextDate(job.scheduled_at, job.repeat_type);
          if (nextDate) {
            db.prepare(`
              INSERT INTO schedules (id, platform, message, destinations, scheduled_at, repeat_type, delay_seconds, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            `).run(uuidv4(), job.platform, job.message, job.destinations, nextDate, job.repeat_type, job.delay_seconds);
          }
        }

      } catch (e) {
        console.error(`❌ Erro no job ${job.id}:`, e.message);
        db.prepare(`UPDATE schedules SET status = 'error', error = ? WHERE id = ?`)
          .run(e.message, job.id);
      }
    }
  } catch (e) {
    console.error('❌ Erro no scheduler:', e.message);
  }
});

function calcNextDate(dateStr, repeat_type) {
  const d = new Date(dateStr);
  if (repeat_type === 'daily')   d.setDate(d.getDate() + 1);
  else if (repeat_type === 'weekly')  d.setDate(d.getDate() + 7);
  else if (repeat_type === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString();
}

console.log('⏰ Scheduler iniciado — verificando agendamentos a cada minuto');
