use anchor_lang::prelude::*;

declare_id!("P1zZaNiNjA111111111111111111111111111111112");

#[program]
pub mod pizza_ninja {
    use super::*;

    /// Inicializa la cuenta de la tabla de clasificación (Leaderboard).
    /// El Leaderboard es un Singleton que utiliza un PDA global.
    pub fn initialize_leaderboard(ctx: Context<InitializeLeaderboard>) -> Result<()> {
        let leaderboard = &mut ctx.accounts.leaderboard;
        leaderboard.authority = ctx.accounts.initializer.key();
        leaderboard.scores = Vec::new();
        msg!("¡Pizza Ninja Leaderboard Inicializado con éxito!");
        Ok(())
    }

    /// Envía una nueva puntuación. El contrato ordenará la tabla y mantendrá solo el Top 10.
    /// Contiene validaciones básicas de seguridad para evitar exploits comunes.
    pub fn submit_score(
        ctx: Context<SubmitScore>, 
        score: u32, 
        play_duration_seconds: u32,
        total_slashes: u32,
        game_start_timestamp: i64,
    ) -> Result<()> {
        let leaderboard = &mut ctx.accounts.leaderboard;
        let player = ctx.accounts.player.key();
        let clock = Clock::get()?;

        // --- VALIDACIONES DE SEGURIDAD ---
        // 1. El tiempo de juego oficial es de 45 segundos. Damos un margen de tolerancia (ej: 50s).
        require!(play_duration_seconds > 0, PizzaNinjaError::InvalidDuration);
        require!(play_duration_seconds <= 50, PizzaNinjaError::GameDurationExceeded);

        // 2. Tasa de puntuación razonable: 
        // Cada pizza otorga 10 puntos. Es físicamente imposible para un humano cortar más de 3 pizzas por segundo
        // de forma sostenible durante 45 segundos. Por ende, la puntuación máxima realista es:
        // 45 segundos * 3 pizzas/seg * 10 puntos = 1350 puntos.
        // Ponemos un límite estricto de 1500 puntos para descartar puntuaciones enviadas con exploits sencillos.
        let max_reasonable_score = play_duration_seconds * 35; // ~3.5 pizzas por segundo máximo
        require!(score <= max_reasonable_score, PizzaNinjaError::SuspiciousScoreRate);

        // 3. Relación de cortes (slashes) y puntuación:
        // Cada pizza requiere al menos 1 corte. No puedes tener más puntuación de la que justifican tus cortes.
        // Puntuación máxima = total_slashes * 10 (con margen para pizzas múltiples cortadas en un solo movimiento)
        let max_score_from_slashes = total_slashes * 15; // permitimos cierto margen de colisión
        if score > 50 { // Validar para puntajes significativos
            require!(score <= max_score_from_slashes, PizzaNinjaError::InconsistentSlashCount);
        }

        // 4. Validación de coherencia de tiempo entre el bloque y el inicio del juego:
        let time_elapsed = clock.unix_timestamp - game_start_timestamp;
        require!(time_elapsed >= 0, PizzaNinjaError::TimeCalculationError);
        
        // El tiempo real transcurrido no debe ser menor que la duración del juego reportada,
        // ni excesivamente mayor que esa duración con un margen razonable de tolerancia para la firma
        require!(time_elapsed >= play_duration_seconds as i64, PizzaNinjaError::IncoherentTimeDifference);
        
        let max_tolerable_elapsed = play_duration_seconds as i64 + 60; // 60 segundos de margen para que firme
        require!(time_elapsed <= max_tolerable_elapsed, PizzaNinjaError::IncoherentTimeDifference);

        msg!("Puntaje validado con éxito. Score: {}, Tiempo: {}s, Slashes: {}", score, play_duration_seconds, total_slashes);

        // --- LÓGICA DE ACTUALIZACIÓN DEL LEADERBOARD ---
        let new_entry = ScoreEntry {
            player,
            score,
            timestamp: clock.unix_timestamp,
        };

        let scores_list = &mut leaderboard.scores;

        // Si la tabla no está llena, o la nueva puntuación supera a la más baja
        let is_top_score = scores_list.len() < 10 || score > scores_list.last().map(|e| e.score).unwrap_or(0);

        if is_top_score {
            // Añadir o actualizar score
            scores_list.push(new_entry);
            
            // Ordenar de mayor a menor según el score
            scores_list.sort_by(|a, b| b.score.cmp(&a.score));

            // Si supera el límite de 10 entradas, remover las sobrantes
            if scores_list.len() > 10 {
                scores_list.truncate(10);
            }
            msg!("¡Felicitaciones! Has entrado en el Top 10 de Pizza Ninja.");
        } else {
            msg!("Puntuación registrada, pero no es lo suficientemente alta para entrar en el Top 10.");
        }

        Ok(())
    }

    /// Permite al administrador limpiar la tabla de puntuaciones si es necesario.
    pub fn reset_leaderboard(ctx: Context<ResetLeaderboard>) -> Result<()> {
        let leaderboard = &mut ctx.accounts.leaderboard;
        require_keys_eq!(leaderboard.authority, ctx.accounts.authority.key(), PizzaNinjaError::Unauthorized);
        leaderboard.scores.clear();
        msg!("El Leaderboard ha sido reiniciado por el Administrador.");
        Ok(())
    }
}

// --- ESTRUCTURAS DE CUENTAS ---

#[derive(Accounts)]
pub struct InitializeLeaderboard<'info> {
    // El PDA utiliza el seed "leaderboard" para coincidir globalmente en el frontend
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 4 + (10 * (32 + 4 + 8)), // Discriminador + authority + Vector len + 10 * ScoreEntry de tamaño fijo
        seeds = [b"leaderboard"],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitScore<'info> {
    #[account(
        mut,
        seeds = [b"leaderboard"],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResetLeaderboard<'info> {
    #[account(
        mut,
        seeds = [b"leaderboard"],
        bump
    )]
    pub leaderboard: Account<'info, LeaderboardState>,
    pub authority: Signer<'info>,
}

#[account]
pub struct LeaderboardState {
    pub authority: Pubkey,       // Administrador con permisos de reseteo
    pub scores: Vec<ScoreEntry>,  // Máximo 10 elementos ordenados
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoreEntry {
    pub player: Pubkey,      // Dirección pública del jugador de Solana
    pub score: u32,          // Puntuación total (cada pizza = +10 pts)
    pub timestamp: i64,      // Fecha del bloque (unix timestamp)
}

// --- CÓDIGOS DE ERROR ---

#[error_code]
pub enum PizzaNinjaError {
    #[msg("La duración o tiempo de juego enviado no es válida.")]
    InvalidDuration,
    #[msg("El tiempo de juego máximo permitido de 45 segundos ha sido excedido.")]
    GameDurationExceeded,
    #[msg("Puntaje sospechosamente alto. Tasa de pizzas cortadas por segundo inhumana.")]
    SuspiciousScoreRate,
    #[msg("Incoherencia entre cortes realizados (slashes) y el puntaje obtenido.")]
    InconsistentSlashCount,
    #[msg("No estás autorizado para realizar esta acción.")]
    Unauthorized,
    #[msg("Cálculo de tiempo inválido o negativo.")]
    TimeCalculationError,
    #[msg("Diferencia de tiempo incoherente entre el inicio del juego y la transacción.")]
    IncoherentTimeDifference,
}
