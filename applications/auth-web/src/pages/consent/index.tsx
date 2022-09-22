import React, { useEffect } from "react";
import axios from "axios";
import type { NextPage } from "next";
import { AuthenticationPageWrapper } from "../../components/pages/authentication-page-wrapper";
import { Loader } from "../../components/loader/loader";
import { useCallback, useState } from "react";
import { useRouter } from "next/router";

const Page: NextPage = () => {
  const router = useRouter();
  const [consentData, setConsentData] = useState();

  const getConsent = useCallback(() => {
    axios.get(`/api/sessions/consent?session_id=${router.query.session_id}`).then((response) => {
      if (response.data.redirectTo) {
        window.location.replace(response.data.redirectTo);
      } else {
        setConsentData(response.data);
      }
    });
  }, [router, setConsentData]);

  useEffect(() => getConsent(), []);

  return (
    <AuthenticationPageWrapper>{consentData ? <>CONSENT</> : <Loader />}</AuthenticationPageWrapper>
  );
};

export default Page;
