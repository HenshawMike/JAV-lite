import { redirect } from 'next/navigation'
import { CURRENT_TERMS_VERSION } from '@/lib/constants'

export default function TermsRedirect() {
  redirect(`/legal/terms/${CURRENT_TERMS_VERSION}`)
}
