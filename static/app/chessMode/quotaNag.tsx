import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Pawn Patrol — the plan nag.
 *
 * Real Sentry's chrome is never free of commerce furniture, so its absence is
 * conspicuous. This sits in the secondary sidebar's footer row (the third track
 * of its `auto 1fr auto` grid, which is otherwise unused) and carries the same
 * shape as a quota warning: a usage meter, the thing you've run out of, and the
 * upgrade button.
 */
export function BlunderQuotaNag() {
  const organization = useOrganization();

  return (
    <Container padding="md" borderTop="primary">
      <Stack gap="sm">
        <Text size="xs" bold uppercase variant="muted">
          {t('Blunder Quota')}
        </Text>
        {/* Usage meter — pinned at 100%, which is the joke. */}
        <MeterTrack>
          <MeterFill />
        </MeterTrack>
        <Text size="xs" variant="muted">
          {t(
            "You've used 100% of your monthly blunder quota. Additional blunders are being rate-limited."
          )}
        </Text>
        <LinkButton
          size="xs"
          variant="primary"
          to={`/settings/${organization.slug}/billing/overview/`}
        >
          {t('Upgrade to Grandmaster')}
        </LinkButton>
      </Stack>
    </Container>
  );
}

const MeterTrack = styled('div')`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background: ${p => p.theme.tokens.background.tertiary};
`;

const MeterFill = styled('div')`
  width: 100%;
  height: 100%;
  background: ${p => p.theme.tokens.graphics.danger.vibrant};
`;
