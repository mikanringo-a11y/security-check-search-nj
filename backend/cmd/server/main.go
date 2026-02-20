package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"cloud.google.com/go/pubsub/v2"
	"connectrpc.com/connect"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	securityv1 "github.com/asuka-sakamoto/security-system/gen/proto/security/v1"
	"github.com/asuka-sakamoto/security-system/gen/proto/security/v1/securityv1connect"
)

type SecurityServer struct{}

func (s *SecurityServer) Ping(
	ctx context.Context,
	req *connect.Request[securityv1.PingRequest],
) (*connect.Response[securityv1.PingResponse], error) {
	fmt.Printf("Ping request received: %s\n", req.Msg.Message)
	return connect.NewResponse(&securityv1.PingResponse{
		Message: "Pong: " + req.Msg.Message,
	}), nil
}

// 修正ポイント: ListControllers ではなく ListControls に変更
func (s *SecurityServer) ListControls(
	ctx context.Context,
	req *connect.Request[securityv1.ListControlsRequest],
) (*connect.Response[securityv1.ListControlsResponse], error) {
	return connect.NewResponse(&securityv1.ListControlsResponse{}), nil
}

func startPubSubListener(projectID string, subID string) {
	ctx := context.Background()
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		fmt.Printf("Failed to create Pub/Sub client: %v\n", err)
		return
	}
	defer client.Close()

	sub := client.Subscriber(subID)
	log.Printf("Listening for messages on subscription: %s\n", subID)
	err = sub.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
		fileName := msg.Attributes["objectId"]
		eventType := msg.Attributes["eventType"]
		if eventType == "OBJECT_FINALIZE" {
			log.Printf("New file uploaded: %s\n", fileName)
			// ここでファイル処理のロジックを実装
		} else {
			log.Printf("Received non-finalize event: %s for file: %s\n", eventType, fileName)
		}
		msg.Ack()
	})
	if err != nil {
		fmt.Printf("Error receiving messages: %v\n", err)
	}
}
func main() {
	mux := http.NewServeMux()
	pathName, handler := securityv1connect.NewSecurityServiceHandler(&SecurityServer{})
	mux.Handle(pathName, handler)
	go startPubSubListener("welcome-study-sakamoto", "ingestion-subscription")
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000"},
		AllowedMethods: []string{"POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Connect-Protocol-Version"},
	})

	fmt.Printf(" Server is running on http://localhost:8080\n")
	if err := http.ListenAndServe(":8080", c.Handler(h2c.NewHandler(mux, &http2.Server{}))); err != nil {
		fmt.Printf("Failed to start server: %v\n", err)
	}
}
