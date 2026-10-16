import { redirect } from 'next/navigation'
import { CURRENT_PRIVACY_VERSION } from '@/lib/constants'

export default function PrivacyRedirect() {
  redirect(`/legal/privacy/${CURRENT_PRIVACY_VERSION}`)
}
